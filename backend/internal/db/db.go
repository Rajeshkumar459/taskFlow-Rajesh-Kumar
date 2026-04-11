package db

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	pool *pgxpool.Pool
}

func New(dsn string) (*DB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	return &DB{pool: pool}, nil
}

func (d *DB) Close() {
	d.pool.Close()
}

// ── User ──────────────────────────────────────────────────────────────────────

type User struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Password  string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

func (d *DB) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	u := &User{}
	err := d.pool.QueryRow(ctx,
		`SELECT id, name, email, password, created_at FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.Name, &u.Email, &u.Password, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (d *DB) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	u := &User{}
	err := d.pool.QueryRow(ctx,
		`SELECT id, name, email, password, created_at FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Name, &u.Email, &u.Password, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (d *DB) CreateUser(ctx context.Context, name, email, hashedPassword string) (*User, error) {
	u := &User{}
	err := d.pool.QueryRow(ctx,
		`INSERT INTO users (id, name, email, password, created_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, NOW())
		 RETURNING id, name, email, password, created_at`,
		name, email, hashedPassword,
	).Scan(&u.ID, &u.Name, &u.Email, &u.Password, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (d *DB) GetAllUsers(ctx context.Context) ([]User, error) {
	rows, err := d.pool.Query(ctx,
		`SELECT id, name, email, created_at FROM users ORDER BY name ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// ── ProjectMember ─────────────────────────────────────────────────────────────

type ProjectMember struct {
	ProjectID uuid.UUID `json:"project_id"`
	UserID    uuid.UUID `json:"user_id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	JoinedAt  time.Time `json:"joined_at"`
}

func (d *DB) GetProjectMembers(ctx context.Context, projectID uuid.UUID) ([]ProjectMember, error) {
	rows, err := d.pool.Query(ctx,
		`SELECT pm.project_id, pm.user_id, u.name, u.email, pm.role, pm.joined_at
		 FROM project_members pm
		 JOIN users u ON u.id = pm.user_id
		 WHERE pm.project_id = $1
		 ORDER BY pm.joined_at ASC`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []ProjectMember
	for rows.Next() {
		var m ProjectMember
		if err := rows.Scan(&m.ProjectID, &m.UserID, &m.Name, &m.Email, &m.Role, &m.JoinedAt); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

// GetProjectMember returns a single membership record, or pgx.ErrNoRows if the user is not a member.
func (d *DB) GetProjectMember(ctx context.Context, projectID, userID uuid.UUID) (*ProjectMember, error) {
	m := &ProjectMember{}
	err := d.pool.QueryRow(ctx,
		`SELECT pm.project_id, pm.user_id, u.name, u.email, pm.role, pm.joined_at
		 FROM project_members pm
		 JOIN users u ON u.id = pm.user_id
		 WHERE pm.project_id = $1 AND pm.user_id = $2`,
		projectID, userID,
	).Scan(&m.ProjectID, &m.UserID, &m.Name, &m.Email, &m.Role, &m.JoinedAt)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (d *DB) AddProjectMember(ctx context.Context, projectID, userID uuid.UUID, role string) (*ProjectMember, error) {
	m := &ProjectMember{}
	err := d.pool.QueryRow(ctx,
		`INSERT INTO project_members (project_id, user_id, role)
		 VALUES ($1, $2, $3)
		 RETURNING project_id, user_id, role, joined_at`,
		projectID, userID, role,
	).Scan(&m.ProjectID, &m.UserID, &m.Role, &m.JoinedAt)
	if err != nil {
		return nil, err
	}
	// Fetch user details to populate Name/Email
	user, err := d.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	m.Name = user.Name
	m.Email = user.Email
	return m, nil
}

func (d *DB) UpdateMemberRole(ctx context.Context, projectID, userID uuid.UUID, role string) (*ProjectMember, error) {
	m := &ProjectMember{}
	err := d.pool.QueryRow(ctx,
		`UPDATE project_members SET role = $3
		 WHERE project_id = $1 AND user_id = $2
		 RETURNING project_id, user_id, role, joined_at`,
		projectID, userID, role,
	).Scan(&m.ProjectID, &m.UserID, &m.Role, &m.JoinedAt)
	if err != nil {
		return nil, err
	}
	user, err := d.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	m.Name = user.Name
	m.Email = user.Email
	return m, nil
}

func (d *DB) RemoveProjectMember(ctx context.Context, projectID, userID uuid.UUID) error {
	_, err := d.pool.Exec(ctx,
		`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
		projectID, userID,
	)
	return err
}

// CountProjectAdmins returns the number of admins in a project (used to prevent removing last admin).
func (d *DB) CountProjectAdmins(ctx context.Context, projectID uuid.UUID) (int, error) {
	var count int
	err := d.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM project_members WHERE project_id = $1 AND role = 'admin'`,
		projectID,
	).Scan(&count)
	return count, err
}

// ── Project ───────────────────────────────────────────────────────────────────

type Project struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	OwnerID     uuid.UUID `json:"owner_id"`
	CreatedAt   time.Time `json:"created_at"`
}

// GetProjectsByUser returns projects where the user is a member (any role).
func (d *DB) GetProjectsByUser(ctx context.Context, userID uuid.UUID) ([]Project, error) {
	rows, err := d.pool.Query(ctx,
		`SELECT p.id, p.name, p.description, p.owner_id, p.created_at
		 FROM projects p
		 JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
		 ORDER BY p.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (d *DB) GetProjectByID(ctx context.Context, id uuid.UUID) (*Project, error) {
	p := &Project{}
	err := d.pool.QueryRow(ctx,
		`SELECT id, name, description, owner_id, created_at FROM projects WHERE id = $1`, id,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

// CreateProjectWithOwner creates the project and adds the creator as an admin in a single transaction.
func (d *DB) CreateProjectWithOwner(ctx context.Context, name string, description *string, ownerID uuid.UUID) (*Project, error) {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	p := &Project{}
	err = tx.QueryRow(ctx,
		`INSERT INTO projects (id, name, description, owner_id, created_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, NOW())
		 RETURNING id, name, description, owner_id, created_at`,
		name, description, ownerID,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert project: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'admin')`,
		p.ID, ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("insert owner membership: %w", err)
	}

	return p, tx.Commit(ctx)
}

func (d *DB) UpdateProject(ctx context.Context, id uuid.UUID, name string, description *string) (*Project, error) {
	p := &Project{}
	err := d.pool.QueryRow(ctx,
		`UPDATE projects SET name = $2, description = $3
		 WHERE id = $1
		 RETURNING id, name, description, owner_id, created_at`,
		id, name, description,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (d *DB) DeleteProject(ctx context.Context, id uuid.UUID) error {
	_, err := d.pool.Exec(ctx, `DELETE FROM projects WHERE id = $1`, id)
	return err
}

// ── Task ──────────────────────────────────────────────────────────────────────

type Task struct {
	ID          uuid.UUID  `json:"id"`
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	Status      string     `json:"status"`
	Priority    string     `json:"priority"`
	ProjectID   uuid.UUID  `json:"project_id"`
	AssigneeID  *uuid.UUID `json:"assignee_id"`
	DueDate     *time.Time `json:"due_date"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type TaskFilter struct {
	Status     *string
	AssigneeID *uuid.UUID
}

func (d *DB) GetTasksByProject(ctx context.Context, projectID uuid.UUID, filter TaskFilter) ([]Task, error) {
	query := `SELECT id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at
	          FROM tasks WHERE project_id = $1`
	args := []any{projectID}

	if filter.Status != nil {
		args = append(args, *filter.Status)
		query += fmt.Sprintf(" AND status = $%d", len(args))
	}
	if filter.AssigneeID != nil {
		args = append(args, *filter.AssigneeID)
		query += fmt.Sprintf(" AND assignee_id = $%d", len(args))
	}
	query += " ORDER BY created_at ASC"

	rows, err := d.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
			&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (d *DB) GetTaskByID(ctx context.Context, id uuid.UUID) (*Task, error) {
	t := &Task{}
	err := d.pool.QueryRow(ctx,
		`SELECT id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at
		 FROM tasks WHERE id = $1`, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

type CreateTaskInput struct {
	Title       string
	Description *string
	Status      string
	Priority    string
	ProjectID   uuid.UUID
	AssigneeID  *uuid.UUID
	DueDate     *time.Time
}

func (d *DB) CreateTask(ctx context.Context, input CreateTaskInput) (*Task, error) {
	t := &Task{}
	err := d.pool.QueryRow(ctx,
		`INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		 RETURNING id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at`,
		input.Title, input.Description, input.Status, input.Priority,
		input.ProjectID, input.AssigneeID, input.DueDate,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

type UpdateTaskInput struct {
	Title         *string
	Description   *string
	Status        *string
	Priority      *string
	AssigneeID    *uuid.UUID
	DueDate       *time.Time
	ClearAssignee bool
	ClearDueDate  bool
}

func (d *DB) UpdateTask(ctx context.Context, id uuid.UUID, input UpdateTaskInput) (*Task, error) {
	t := &Task{}
	err := d.pool.QueryRow(ctx,
		`UPDATE tasks SET
		   title       = COALESCE($2, title),
		   description = COALESCE($3, description),
		   status      = COALESCE($4, status),
		   priority    = COALESCE($5, priority),
		   assignee_id = CASE WHEN $6 THEN NULL ELSE COALESCE($7, assignee_id) END,
		   due_date    = CASE WHEN $8 THEN NULL ELSE COALESCE($9, due_date) END,
		   updated_at  = NOW()
		 WHERE id = $1
		 RETURNING id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at`,
		id, input.Title, input.Description, input.Status, input.Priority,
		input.ClearAssignee, input.AssigneeID,
		input.ClearDueDate, input.DueDate,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (d *DB) DeleteTask(ctx context.Context, id uuid.UUID) error {
	_, err := d.pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	return err
}

// ── Stats ─────────────────────────────────────────────────────────────────────

type StatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type AssigneeCount struct {
	AssigneeID   *uuid.UUID `json:"assignee_id"`
	AssigneeName *string    `json:"assignee_name"`
	Count        int        `json:"count"`
}

type ProjectStats struct {
	ByStatus   []StatusCount   `json:"by_status"`
	ByAssignee []AssigneeCount `json:"by_assignee"`
}

func (d *DB) GetProjectStats(ctx context.Context, projectID uuid.UUID) (*ProjectStats, error) {
	statusRows, err := d.pool.Query(ctx,
		`SELECT status, COUNT(*) FROM tasks WHERE project_id = $1 GROUP BY status`, projectID,
	)
	if err != nil {
		return nil, err
	}
	defer statusRows.Close()

	stats := &ProjectStats{}
	for statusRows.Next() {
		var sc StatusCount
		if err := statusRows.Scan(&sc.Status, &sc.Count); err != nil {
			return nil, err
		}
		stats.ByStatus = append(stats.ByStatus, sc)
	}
	if err := statusRows.Err(); err != nil {
		return nil, err
	}

	assigneeRows, err := d.pool.Query(ctx,
		`SELECT t.assignee_id, u.name, COUNT(*)
		 FROM tasks t
		 LEFT JOIN users u ON u.id = t.assignee_id
		 WHERE t.project_id = $1
		 GROUP BY t.assignee_id, u.name`, projectID,
	)
	if err != nil {
		return nil, err
	}
	defer assigneeRows.Close()

	for assigneeRows.Next() {
		var ac AssigneeCount
		if err := assigneeRows.Scan(&ac.AssigneeID, &ac.AssigneeName, &ac.Count); err != nil {
			return nil, err
		}
		stats.ByAssignee = append(stats.ByAssignee, ac)
	}
	return stats, assigneeRows.Err()
}
