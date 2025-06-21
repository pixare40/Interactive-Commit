package format

import (
	"fmt"

	"github.com/pixare40/interactive-commit/internal/audio"
)

// FormatCommitMessage formats audio media info into a commit message line
func FormatCommitMessage(media *audio.MediaInfo) string {
	if media == nil {
		return ""
	}
	
	if media.Artist != "" {
		return fmt.Sprintf("🎵 Currently playing: \"%s\" by %s (%s)", media.Title, media.Artist, media.Source)
	}
	return fmt.Sprintf("🎵 Currently playing: \"%s\" (%s)", media.Title, media.Source)
} 