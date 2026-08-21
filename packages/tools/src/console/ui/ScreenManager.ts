import blessed from 'blessed';

export class ScreenManager {
    public screen: blessed.Widgets.Screen;

    constructor(title: string = 'ArX Console') {
        this.screen = blessed.screen({
            smartCSR: true,
            title: title,
            cursor: {
                artificial: true,
                shape: 'line',
                blink: true,
                color: 'white'
            }
        });

        this.screen.key(['escape', 'q', 'C-c'], () => {
            return process.exit(0);
        });
    }

    public render(): void {
        this.screen.render();
    }
}