import blessed from 'blessed';

export class PromptManager {
    private screen: blessed.Widgets.Screen;

    constructor(screen: blessed.Widgets.Screen) {
        this.screen = screen;
    }

    public text(label: string): Promise<string> {
        return new Promise((resolve) => {
            const form = blessed.form({
                parent: this.screen,
                bottom: 0,
                left: 0,
                width: '100%',
                height: '30%',
                border: { type: 'line' },
                label: ` ${label} `
            });

            const input = blessed.textbox({
                parent: form,
                top: 1,
                left: 2,
                right: 2,
                height: 1,
                inputOnFocus: true,
                style: { fg: 'white', bg: 'black', focus: { bg: 'blue' } }
            });

            input.focus();
            this.screen.render();

            input.on('submit', (value: string) => {
                form.destroy();
                this.screen.render();
                resolve(value);
            });
        });
    }

    public select(label: string, items: string[]): Promise<{ index: number; value: string }> {
        return new Promise((resolve) => {
            const list = blessed.list({
                parent: this.screen,
                bottom: 0,
                left: 0,
                width: '100%',
                height: '30%',
                border: { type: 'line' },
                label: ` ${label} `,
                items: items,
                keys: true,
                mouse: true,
                style: {
                    selected: { bg: 'cyan', fg: 'black', bold: true }
                }
            });

            list.focus();
            this.screen.render();

            list.on('select', (_, index) => {
                const selectedValue = items[index];
                list.destroy();
                this.screen.render();
                resolve({ index, value: selectedValue });
            });
        });
    }
}