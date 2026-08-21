import config from "../config";

export class DateFormatter {
    static format(date: Date = new Date()): string {
        var currentConfig = config.current;

        config.onChange((newConfig) => {
            currentConfig = newConfig
        })

        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");

        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const fullYear = date.getFullYear();
        const shortYear = String(fullYear).slice(-2);

        const timeStr =
            currentConfig.timeFormat === "hh:mm:ss"
                ? `${hours}:${minutes}:${seconds}`
                : `${hours}:${minutes}`;

        if (currentConfig.dateFormat === "none") return `[${timeStr}]`;

        let dateStr = "";
        switch (currentConfig.dateFormat) {
            case "dd/mm":
                dateStr = `${day}/${month}`;
                break;
            case "mm/dd":
                dateStr = `${month}/${day}`;
                break;
            case "dd/mm/yy":
                dateStr = `${day}/${month}/${shortYear}`;
                break;
            case "dd/mm/yyyy":
                dateStr = `${day}/${month}/${fullYear}`;
                break;
            case "mm/dd/yy":
                dateStr = `${month}/${day}/${shortYear}`;
                break;
            case "mm/dd/yyyy":
                dateStr = `${month}/${day}/${fullYear}`;
                break;
        }

        return `[${dateStr} ${timeStr}]`;
    }
}