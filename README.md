<div align="center">
  <h1>PRSense</h1>
  <p>The omniscient memory engine for your repositories. Stop redundant engineering execution.</p>
  
  <a href="https://prsense.dev">Website</a> &nbsp;・&nbsp;
  <a href="https://prsense.dev/docs">Full Documentation & Usage Guides</a>
  

  <br/><br/>
</div>

PRSense is an active context engine that vector-indexes your repositories. It acts as an enforcer to stop duplicate Pull Requests, instantly surface historical decisions, and prevent architectural drift across your engineering teams.

## 📚 Documentation
Because PRSense scales from local CLI tools up to enterprise Kubernetes deployments, **we keep our full documentation on our website.**

Here you will find everything you need:
- [Quick Start Guide](https://prsense.dev/docs/quick-start)
- [Installing the GitHub Action](https://prsense.dev/docs/GITHUB_ACTION)
- [Using the Command Line Interface (CLI)](https://prsense.dev/docs/cli-usage)
- [Deploying as a Microservice](https://prsense.dev/docs/deployment)
- [How our Semantic Scoring works](https://prsense.dev/docs/scoring)

---

## ⚡ Quick Snippets

If you just want to run the CLI locally right now:

```bash
# 1. Install the CLI directly from npm
npm install -g prsense

# 2. Add your OpenAI Key (or configure local ONNX)
export OPENAI_API_KEY="sk-..."

# 3. Check your current branch for duplicates against your main branch history!
prsense check
```

For setting up Webhooks, CI/CD Actions, or the Enterprise Dashboard, please view our [official documentation](https://prsense.dev/docs).

---

## 🤝 Contributing & Support

We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) file for setup instructions.
If you need help, feel free to open an Issue or reach out to the community via [prsense.dev](https://prsense.dev).

<div align="center">
  <br />
  <sub>Copyright © 2026 PRSense Labs. Open Source. Developer First.</sub>
</div>
