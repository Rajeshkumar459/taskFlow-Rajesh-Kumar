// Package events provides an in-memory SSE event broker.
package events

import (
	"encoding/json"
	"log/slog"
	"sync"
)

// Envelope is the shape of every SSE payload sent to clients.
type Envelope struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

// Broker fans out events to all SSE clients subscribed to a project.
type Broker struct {
	mu      sync.RWMutex
	clients map[string]map[chan []byte]struct{} // projectID → set of channels
}

func NewBroker() *Broker {
	return &Broker{
		clients: make(map[string]map[chan []byte]struct{}),
	}
}

// Subscribe registers a new client for the given project and returns:
//   - a read-only channel that receives serialised SSE data lines
//   - an unsubscribe function that must be called when the client disconnects
func (b *Broker) Subscribe(projectID string) (<-chan []byte, func()) {
	ch := make(chan []byte, 16)

	b.mu.Lock()
	if b.clients[projectID] == nil {
		b.clients[projectID] = make(map[chan []byte]struct{})
	}
	b.clients[projectID][ch] = struct{}{}
	b.mu.Unlock()

	unsubscribe := func() {
		b.mu.Lock()
		delete(b.clients[projectID], ch)
		if len(b.clients[projectID]) == 0 {
			delete(b.clients, projectID)
		}
		b.mu.Unlock()
		close(ch)
		slog.Debug("SSE client disconnected", "project_id", projectID)
	}

	slog.Debug("SSE client connected", "project_id", projectID)
	return ch, unsubscribe
}

// Publish serialises eventType + payload and delivers it to every subscriber
// of the project. Slow clients are skipped (non-blocking send).
func (b *Broker) Publish(projectID, eventType string, payload any) {
	data, err := json.Marshal(Envelope{Type: eventType, Payload: payload})
	if err != nil {
		slog.Error("SSE marshal error", "err", err)
		return
	}

	b.mu.RLock()
	defer b.mu.RUnlock()

	for ch := range b.clients[projectID] {
		select {
		case ch <- data:
		default: // drop slow client rather than blocking
		}
	}
}
