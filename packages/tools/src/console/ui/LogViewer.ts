import blessed from "blessed";

export class LogViewer {
    public logBox: blessed.Widgets.Log;

    constructor(screen: blessed.Widgets.Screen) {
        this.logBox = blessed.log({
            parent: screen,
            top: 0,
            left: 0,
            width: "100%",
            height: "70%",
            border: { type: "line" },
            tags: true,
            style: {
                fg: "white",
                border: { fg: "#50fa7b" },
            },
            scrollable: true,
            scrollbar: {
                ch: " ",
                style: { bg: "blue" },
            },
        });
    }

    public addLog(entry: string): void {
        this.logBox.add(entry);
        this.logBox.screen.render();
    }
}