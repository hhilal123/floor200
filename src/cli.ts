#!/usr/bin/env node

import { Command } from "commander";

import { demoData } from "./demo-data.js";
import { renderReport } from "./report.js";

const program = new Command()
  .name("floor200")
  .description("AI coding-agent ROI, from spend to shipped PRs.")
  .version("0.1.0");

const printDemo = (): void => {
  console.log(renderReport(demoData));
};

program
  .command("demo")
  .description("Print a demo ROI report using fake data")
  .action(printDemo);

program
  .command("report")
  .description("Print an ROI report")
  .option("--demo", "use built-in fake data")
  .action((options: { demo?: boolean }) => {
    if (!options.demo) {
      program.error("The first version only supports: floor200 report --demo");
    }

    printDemo();
  });

program.parse();
