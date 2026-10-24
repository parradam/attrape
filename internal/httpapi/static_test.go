package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestSPA(t *testing.T) {
	files := fstest.MapFS{
		"index.html":        {Data: []byte("<html>app</html>")},
		"assets/app-abc.js": {Data: []byte("console.log(1)")},
		"favicon.svg":       {Data: []byte("<svg/>")},
	}
	h := spa(files)

	tests := []struct {
		name      string
		path      string
		wantBody  string
		wantCache string
	}{
		{"root", "/", "<html>app</html>", "no-cache"},
		{"index", "/index.html", "<html>app</html>", "no-cache"},
		{"client route", "/inbox", "<html>app</html>", "no-cache"},
		{"hashed asset", "/assets/app-abc.js", "console.log(1)", "public, max-age=31536000, immutable"},
		{"other file", "/favicon.svg", "<svg/>", ""},
		{"directory", "/assets", "<html>app</html>", "no-cache"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.path, nil))

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200", rec.Code)
			}
			if got := rec.Body.String(); got != tt.wantBody {
				t.Errorf("body = %q, want %q", got, tt.wantBody)
			}
			if got := rec.Header().Get("Cache-Control"); got != tt.wantCache {
				t.Errorf("Cache-Control = %q, want %q", got, tt.wantCache)
			}
		})
	}
}

func TestSPANotBuilt(t *testing.T) {
	rec := httptest.NewRecorder()
	spa(fstest.MapFS{}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusNotFound || !strings.Contains(rec.Body.String(), "just build") {
		t.Errorf("got %d %q, want 404 mentioning just build", rec.Code, rec.Body.String())
	}
}

func TestUnknownAPIPathIsNotTheApp(t *testing.T) {
	rec := do(t, newTestHandler(t), http.MethodGet, "/api/nope", "")
	if rec.Code != http.StatusNotFound || strings.Contains(rec.Body.String(), "<html>") {
		t.Errorf("got %d %q, want a plain 404", rec.Code, rec.Body.String())
	}
}
