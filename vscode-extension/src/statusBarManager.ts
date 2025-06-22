import * as vscode from 'vscode';
import { AudioDetector, MediaInfo } from './audioDetector';
import { ConfigManager } from './configManager';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private updateTimer: NodeJS.Timer | undefined;
    private currentMedia: MediaInfo | null = null;

    constructor(
        private audioDetector: AudioDetector,
        private config: ConfigManager
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        this.statusBarItem.command = 'interactive-commit.detectAudio';
        this.statusBarItem.tooltip = 'Click to detect audio • Interactive Commit';
    }

    start() {
        if (this.config.showStatusBar()) {
            this.statusBarItem.show();
            this.startUpdating();
        }

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('interactive-commit.showStatusBar')) {
                if (this.config.showStatusBar()) {
                    this.statusBarItem.show();
                    this.startUpdating();
                } else {
                    this.statusBarItem.hide();
                    this.stopUpdating();
                }
            }
            
            if (e.affectsConfiguration('interactive-commit.refreshInterval')) {
                this.startUpdating(); // Restart with new interval
            }
        });
    }

    private startUpdating() {
        this.stopUpdating();
        
        const interval = this.config.getRefreshInterval();
        this.updateTimer = setInterval(() => {
            this.updateStatusBar();
        }, interval);

        // Initial update
        this.updateStatusBar();
    }

    private stopUpdating() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = undefined;
        }
    }

    private async updateStatusBar() {
        try {
            const media = await this.audioDetector.detectCurrentAudio();
            
            if (media) {
                this.currentMedia = media;
                this.statusBarItem.text = this.formatStatusText(media);
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = this.formatTooltip(media);
            } else {
                if (this.currentMedia) {
                    // Recently stopped playing
                    this.currentMedia = null;
                    this.statusBarItem.text = '🔇 No audio';
                    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                    this.statusBarItem.tooltip = 'No audio currently playing • Interactive Commit';
                } else {
                    // Still no audio
                    this.statusBarItem.text = '🎵 Interactive Commit';
                    this.statusBarItem.backgroundColor = undefined;
                    this.statusBarItem.tooltip = 'Click to detect audio • Interactive Commit';
                }
            }
        } catch (error) {
            console.error('Status bar update failed:', error);
            this.statusBarItem.text = '🎵 Detection Error';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.tooltip = `Audio detection failed: ${error} • Interactive Commit`;
        }
    }

    private formatStatusText(media: MediaInfo): string {
        const maxLength = 50;
        let text = '';

        if (media.artist) {
            text = `🎵 ${media.title} - ${media.artist}`;
        } else {
            text = `🎵 ${media.title}`;
        }

        // Add source indicator
        const sourceIcon = this.getSourceIcon(media.source);
        if (sourceIcon) {
            text = `${sourceIcon} ${text.substring(2)}`; // Replace 🎵 with source icon
        }

        // Truncate if too long
        if (text.length > maxLength) {
            text = text.substring(0, maxLength - 3) + '...';
        }

        return text;
    }

    private formatTooltip(media: MediaInfo): string {
        let tooltip = `🎵 Currently Playing:\n`;
        tooltip += `Title: ${media.title}\n`;
        if (media.artist) {
            tooltip += `Artist: ${media.artist}\n`;
        }
        if (media.album) {
            tooltip += `Album: ${media.album}\n`;
        }
        tooltip += `Source: ${media.source}\n`;
        tooltip += `Type: ${media.type}\n\n`;
        tooltip += `Click to detect audio • Interactive Commit`;
        
        return tooltip;
    }

    private getSourceIcon(source: string): string {
        const icons: { [key: string]: string } = {
            'Spotify': '🟢',
            'YouTube': '🔴',
            'YouTube Music': '🎵',
            'Chrome': '🌐',
            'Edge': '🔵',
            'Firefox': '🦊',
            'VLC': '🎬',
            'iTunes': '🍎',
            'Apple Music': '🍎'
        };

        return icons[source] || '🎵';
    }

    getCurrentMedia(): MediaInfo | null {
        return this.currentMedia;
    }

    dispose() {
        this.stopUpdating();
        this.statusBarItem.dispose();
    }
} 