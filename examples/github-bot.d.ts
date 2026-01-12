/**
 * Example: GitHub Bot Integration
 *
 * This shows how to integrate PRSense with GitHub webhooks
 */
interface GitHubClient {
    issues: {
        createComment(params: {
            body: string;
            issue_number: number;
        }): Promise<void>;
    };
}
/**
 * GitHub webhook handler
 */
export declare function handlePullRequestWebhook(event: any, github: GitHubClient): Promise<void>;
/**
 * Example Express server
 */
export declare function setupGitHubWebhook(): {
    post: (path: string, handler: Function) => void;
};
export {};
//# sourceMappingURL=github-bot.d.ts.map