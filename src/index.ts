import path from "path";
import { main } from "./engine";

await main();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

await wait(1000);
console.log("hehe");
