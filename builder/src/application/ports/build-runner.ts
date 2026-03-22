export interface BuildRunner {
   run(options: { cwd: string }): Promise<{ exitCode: number | null }>
}