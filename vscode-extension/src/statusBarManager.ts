import * as vscode from 'vscode';
import { AudioDetector, MediaInfo } from './audioDetector';
import { ConfigManager } from './configManager';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private controlButtons: vscode.StatusBarItem[] = [];
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
        
        // Create control buttons
        this.createControlButtons();
    }

    private createControlButtons() {
        // Previous button
        const prevButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 103);
        prevButton.text = '$(chevron-left)';
        prevButton.command = 'interactive-commit.previousTrack';
        prevButton.tooltip = '⏮ Previous Track';
        
        // Play/Pause button  
        const playButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 102);
        playButton.text = '$(debug-pause)';
        playButton.command = 'interactive-commit.playPause';
        playButton.tooltip = '⏯ Play/Pause';
        
        // Next button
        const nextButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
        nextButton.text = '$(chevron-right)';
        nextButton.command = 'interactive-commit.nextTrack';
        nextButton.tooltip = '⏭ Next Track';
        
        this.controlButtons = [prevButton, playButton, nextButton];
    }

    private showControlButtons() {
        if (this.config.showStatusBar()) {
            this.controlButtons.forEach(button => button.show());
        }
    }

    private hideControlButtons() {
        this.controlButtons.forEach(button => button.hide());
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
                this.showControlButtons();
            } else {
                if (this.currentMedia) {
                    // Recently stopped playing
                    this.currentMedia = null;
                    this.statusBarItem.text = '$(mute) No audio';
                    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                    this.statusBarItem.tooltip = 'No audio currently playing • Interactive Commit';
                    this.hideControlButtons();
                } else {
                    // Still no audio
                    this.statusBarItem.text = '$(music) Interactive Commit';
                    this.statusBarItem.backgroundColor = undefined;
                    this.statusBarItem.tooltip = 'Click to detect audio • Interactive Commit';
                    this.hideControlButtons();
                }
            }
        } catch (error) {
            console.error('Status bar update failed:', error);
            this.statusBarItem.text = '$(warning) Detection Error';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.tooltip = `⚠ Audio detection failed: ${error} • Interactive Commit`;
        }
    }

    private formatStatusText(media: MediaInfo): string {
        const maxLength = 50;
        let text = '';

        if (media.artist) {
            text = `$(music) ${media.title} - ${media.artist}`;
        } else {
            text = `$(music) ${media.title}`;
        }

        // Add source indicator
        const sourceIcon = this.getSourceIcon(media.source);
        if (sourceIcon) {
            text = `${sourceIcon} ${text.substring(8)}`; // Replace $(music) with source icon
        }

        // Add service-specific styling
        text = this.addServiceStyling(text, media.source);

        // Truncate if too long
        if (text.length > maxLength) {
            text = text.substring(0, maxLength - 3) + '...';
        }

        return text;
    }

    private addServiceStyling(text: string, source: string): string {
        // Add subtle service indicators
        switch (source) {
            case 'Spotify':
                return `${text} • Spotify`;
            case 'YouTube Music':
                return `${text} • YT Music`;
            case 'Apple Music':
                return `${text} • Apple Music`;
            default:
                return text;
        }
    }

    private formatTooltip(media: MediaInfo): string {
        let tooltip = `♪ Currently Playing:\n`;
        tooltip += `Title: ${media.title}\n`;
        if (media.artist) {
            tooltip += `Artist: ${media.artist}\n`;
        }
        if (media.album) {
            tooltip += `Album: ${media.album}\n`;
        }
        tooltip += `Source: ${media.source}\n`;
        tooltip += `Type: ${media.type}\n\n`;
        tooltip += `⚙ Click to detect audio • Interactive Commit`;
        
        return tooltip;
    }

    private getSourceIcon(source: string): string {
        const icons: { [key: string]: string } = {
            'Spotify': '$(music)',
            'YouTube': '$(device-camera-video)',
            'YouTube Music': '$(music)',
            'Chrome': '$(browser)',
            'Edge': '$(browser)', 
            'Firefox': '$(browser)',
            'VLC': '$(device-camera-video)',
            'iTunes': '$(music)',
            'Apple Music': '$(music)'
        };

        return icons[source] || '$(music)';
    }

    getCurrentMedia(): MediaInfo | null {
        return this.currentMedia;
    }

    dispose() {
        this.stopUpdating();
        this.statusBarItem.dispose();
        this.controlButtons.forEach(button => button.dispose());
    }
} 