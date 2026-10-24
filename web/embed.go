// Package web holds the built React app for the Go server to serve.
package web

import (
	"embed"
	"io/fs"
)

// dist is filled by `npm run build`. public/.gitkeep is copied into it on
// every build so the directory always exists for go:embed.
//
//go:embed all:dist
var dist embed.FS

// Dist returns the built app, rooted at its index.html.
func Dist() fs.FS {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err)
	}
	return sub
}
