package cli

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "interactive-commit",
	Short: "Transform your git commits with the soundtrack of your code",
	Long: `Interactive-Commit is a git hook that automatically appends your currently
playing audio to commit messages, creating a rich narrative of your development journey.

Ready to soundtrack your code? 🎵`,
	Version: "0.1.0",
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.AddCommand(installCmd)
	rootCmd.AddCommand(detectCmd)
	rootCmd.AddCommand(hookCmd)
} 