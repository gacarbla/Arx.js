import { Config } from "@arx.js/core";
import { Console } from "./console";

export async function test() {
    await Config.load("./config.ini")
    const console = new Console()
    test2(console)
    console.log("Iniciando")
    console.success("Éxito")
    console.input.text("Nombre del usuario").then((t) => {
        console.log(`Usuario: ${t}`)
        console.warn("Advertencia", { colorizeLine: true, bold: true })
        console.error("Error")
        console.input.select("Opción múltiple", [
            "A", "B", "C", "D"
        ]).then(o => {
            console.log(o)
        })
    })
}

async function test2(console: Console) {
    console.on("error", (message) => {
        console.log("Error emitido: ", message)
    })
}