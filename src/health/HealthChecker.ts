import { SkillsScanner } from '../scanner/SkillsScanner.js';
import { CommandsScanner } from '../scanner/CommandsScanner.js';
import { AgentsScanner } from '../scanner/AgentsScanner.js';
import { McpScanner } from '../scanner/McpScanner.js';
import { PromptsScanner } from '../scanner/PromptsScanner.js';
import { checkFrontmatter } from './rules/FrontmatterRule.js';
import { checkBrokenRefs } from './rules/BrokenRefsRule.js';
import { checkDuplicateNames } from './rules/DuplicateNamesRule.js';
import type { HealthIssue, ScanResults } from './types.js';

export class HealthChecker {
  private readonly skillsScanner: SkillsScanner;
  private readonly commandsScanner: CommandsScanner;
  private readonly agentsScanner: AgentsScanner;
  private readonly mcpScanner: McpScanner;
  private readonly promptsScanner: PromptsScanner;

  constructor() {
    this.skillsScanner = new SkillsScanner();
    this.commandsScanner = new CommandsScanner();
    this.agentsScanner = new AgentsScanner();
    this.mcpScanner = new McpScanner();
    this.promptsScanner = new PromptsScanner();
  }

  async scan(workspaceRoot?: string): Promise<HealthIssue[]> {
    const [skills, commands, agents, mcp, prompts] = await Promise.all([
      this.skillsScanner.scanAll(workspaceRoot),
      this.commandsScanner.scanAll(workspaceRoot),
      this.agentsScanner.scanAll(workspaceRoot),
      this.mcpScanner.scanAll(workspaceRoot),
      this.promptsScanner.scanAll(workspaceRoot),
    ]);

    const results: ScanResults = {
      skills,
      commands,
      agents,
      mcp,
      prompts,
    };

    return [
      ...checkFrontmatter(results),
      ...checkBrokenRefs(results),
      ...checkDuplicateNames(results),
    ];
  }
}
