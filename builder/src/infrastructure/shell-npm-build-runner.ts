import { BuildRunner } from "@/application/ports/build-runner";
import { LogPublisher } from "@/application/ports/log-publisher";
import { spawn } from "child_process";

export class ShellNpmBuildRunner implements BuildRunner {
   constructor(private readonly logPublisher: LogPublisher) {}

   async run(options: { cwd: string }): Promise<{ exitCode: number | null }> {
      const installExit = await this.runCommand('npm', ['install'], options.cwd)
      if (installExit !== 0) return { exitCode: installExit }

      const buildExit = await this.runCommand('npm', ['run', 'build'], options.cwd)
      return { exitCode: buildExit }
   }

   private runCommand(command: string, args: string[], cwd: string): Promise<number | null> {
      return new Promise((resolve, reject) => {
         const child = spawn(command, args, { cwd, shell: true })

         child.stdout.on('data', (data: Buffer) => {
            const text = data.toString()
            this.logPublisher.publish(
               `Build: ${text}`,
               { type: 'info', status: 'building' }
            )
         })

         child.stderr.on('data', (data: Buffer) => {
            const text = data.toString()
            this.logPublisher.publish(
               `Error: ${text}`,
               { type: 'error', status: 'error' }
            )
         })

         child.on('error', reject)
         child.on('close', (exitCode) => resolve(exitCode))
      })
   }
}