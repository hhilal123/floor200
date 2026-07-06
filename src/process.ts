import { execFile, type ExecFileException } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: string[]): Promise<CommandResult>;
}

type ExecFileCallback = (
  error: ExecFileException | null,
  stdout: string,
  stderr: string,
) => void;

export type ExecFileImplementation = (
  file: string,
  args: string[],
  options: { encoding: "utf8"; maxBuffer: number },
  callback: ExecFileCallback,
) => void;

export class CommandStartError extends Error {
  constructor(readonly command: string, options?: ErrorOptions) {
    super(`Could not start ${command}`, options);
    this.name = "CommandStartError";
  }
}

export class CommandExitError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: string | number | undefined,
    readonly stderr: string,
    options?: ErrorOptions,
  ) {
    super(`${command} exited unsuccessfully`, options);
    this.name = "CommandExitError";
  }
}

export function createCommandRunner(
  execFileImplementation: ExecFileImplementation,
): CommandRunner {
  return {
    run(command, args) {
      return new Promise((resolve, reject) => {
        execFileImplementation(
          command,
          args,
          { encoding: "utf8", maxBuffer: 10_000_000 },
          (error, stdout, stderr) => {
            if (!error) {
              resolve({ stdout, stderr });
              return;
            }

            if (error.code === "ENOENT") {
              reject(new CommandStartError(command, { cause: error }));
              return;
            }

            reject(
              new CommandExitError(command, error.code ?? undefined, stderr, {
                cause: error,
              }),
            );
          },
        );
      });
    },
  };
}

const productionExecFile: ExecFileImplementation = (
  file,
  args,
  options,
  callback,
) => {
  execFile(file, args, options, callback);
};

export const nodeCommandRunner = createCommandRunner(productionExecFile);
