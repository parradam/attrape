// Package httpapi translates HTTP requests to and from the domain.
package httpapi

import "net/http"

// New returns the application's HTTP handler.
func New() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", health)
	return mux
}

func health(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}
