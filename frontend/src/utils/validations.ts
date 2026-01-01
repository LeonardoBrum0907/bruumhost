export const isValidURL = (githubURL: string): boolean => {
   if (!githubURL) return false

   const githubURLRegex = new RegExp(
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
   )
   return githubURLRegex.test(githubURL)
}