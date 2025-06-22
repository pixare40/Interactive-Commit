import * as vscode from 'vscode';

export class ConfigManager {
    private readonly configSection = 'interactive-commit';

    isEnabled(): boolean {
        return this.getConfig().get('enabled', true);
    }

    showStatusBar(): boolean {
        return this.getConfig().get('showStatusBar', true);
    }

    getAudioSources(): string[] {
        return this.getConfig().get('audioSources', [
            'spotify', 'youtube', 'youtube-music', 'chrome', 'edge'
        ]);
    }

    getCommitFormat(): string {
        return this.getConfig().get('commitFormat', 
            '🎵 Currently playing: "{title}" by {artist} ({source})'
        );
    }

    getRefreshInterval(): number {
        return this.getConfig().get('refreshInterval', 5000);
    }

    getTimeout(): number {
        return this.getConfig().get('timeout', 3000);
    }

    private getConfig(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(this.configSection);
    }

    // Helper methods for specific settings
    isSourceEnabled(source: string): boolean {
        return this.getAudioSources().includes(source.toLowerCase());
    }

    updateSetting(key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global) {
        return this.getConfig().update(key, value, target);
    }

    async resetToDefaults() {
        const config = this.getConfig();
        const keys = [
            'enabled',
            'showStatusBar', 
            'audioSources',
            'commitFormat',
            'refreshInterval',
            'timeout'
        ];

        for (const key of keys) {
            await config.update(key, undefined, vscode.ConfigurationTarget.Global);
        }

        vscode.window.showInformationMessage('Interactive Commit settings reset to defaults');
    }
} 