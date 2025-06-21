package cli

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/pixare40/interactive-commit/internal/audio"
	"github.com/pixare40/interactive-commit/internal/format"
	"github.com/spf13/cobra"
)

var hookCmd = &cobra.Command{
	Use:    "hook",
	Short:  "Git hook handler (internal use)",
	Long:   "This command is called by git hooks. You shouldn't run this manually.",
	Hidden: true,
	RunE:   runHook,
}

func runHook(cmd *cobra.Command, args []string) error {
	// This is called as a git hook
	// args[0] should be the commit message file path
	
	if len(args) < 1 {
		return fmt.Errorf("missing commit message file argument")
	}
	
	commitMsgFile := args[0]
	
	// Read current commit message
	content, err := os.ReadFile(commitMsgFile)
	if err != nil {
		return fmt.Errorf("failed to read commit message file: %w", err)
	}
	
	// Detect currently playing audio
	am := audio.NewAudioManager()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	media, err := am.Detect(ctx)
	if err != nil || media == nil {
		// No audio detected or error - just continue without adding anything
		return nil
	}
	
	// Check if there's actual commit content (non-comment, non-whitespace lines)
	lines := strings.Split(string(content), "\n")
	hasRealContent := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
			hasRealContent = true
			break
		}
	}
	
	if !hasRealContent {
		return nil // No actual commit content, don't add anything
	}
	
	// Format the audio info using shared utility
	audioLine := format.FormatCommitMessage(media)
	
	// Preserve original content structure, only trim trailing newlines
	originalContent := strings.TrimRight(string(content), "\n")
	
	// Append audio info with proper spacing
	newContent := originalContent + "\n\n" + audioLine + "\n"
	
	// Write back to file
	if err := os.WriteFile(commitMsgFile, []byte(newContent), 0644); err != nil {
		return fmt.Errorf("failed to write commit message file: %w", err)
	}
	
	return nil
} 