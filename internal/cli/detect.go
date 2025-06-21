package cli

import (
	"context"
	"fmt"
	"time"

	"github.com/pixare40/interactive-commit/internal/audio"
	"github.com/spf13/cobra"
)

var detectCmd = &cobra.Command{
	Use:   "detect",
	Short: "Detect currently playing audio",
	Long: `Test audio detection and show what's currently playing.

This command helps debug audio detection issues and shows
exactly what would be added to your commit messages.`,
	RunE: runDetect,
}

func runDetect(cmd *cobra.Command, args []string) error {
	fmt.Println("🎵 Detecting currently playing audio...")
	
	am := audio.NewAudioManager()
	
	// Show available detectors
	detectors := am.ListDetectors()
	fmt.Printf("📡 Available detectors: %d\n", len(detectors))
	for _, detector := range detectors {
		fmt.Printf("  ✅ %s\n", detector.Name())
	}
	
	if len(detectors) == 0 {
		fmt.Println("❌ No audio detectors available on this platform")
		return nil
	}
	
	// Try to detect audio
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	media, err := am.Detect(ctx)
	if err != nil {
		fmt.Printf("❌ Detection failed: %v\n", err)
		return nil
	}
	
	if media == nil {
		fmt.Println("🔇 No audio currently playing")
		return nil
	}
	
	// Display results
	fmt.Println("\n🎵 Currently playing:")
	fmt.Printf("   Title:  %s\n", media.Title)
	fmt.Printf("   Artist: %s\n", media.Artist)
	fmt.Printf("   Album:  %s\n", media.Album)
	fmt.Printf("   Source: %s\n", media.Source)
	fmt.Printf("   Type:   %s\n", media.Type)
	
	// Show what would be added to commit
	commitText := formatForCommit(media)
	fmt.Printf("\n💬 Commit message addition:\n%s\n", commitText)
	
	return nil
}

func formatForCommit(media *audio.MediaInfo) string {
	if media.Artist != "" {
		return fmt.Sprintf("🎵 Currently playing: \"%s\" by %s (%s)", media.Title, media.Artist, media.Source)
	}
	return fmt.Sprintf("🎵 Currently playing: \"%s\" (%s)", media.Title, media.Source)
} 