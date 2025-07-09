<h1 align="center">Welcome to Chainlit 👋</h1>

This is the backend package for Chainlit, a Python framework for building conversational AI applications. The backend provides the core functionality for creating chat interfaces, managing conversations, and integrating with various AI models and services.

## Features

</p>
<p align="center">
    <a href="https://discord.gg/k73SQ3FyUh" rel="nofollow"><img alt="Discord" src="https://dcbadge.vercel.app/api/server/ZThrUxbAYw?style=flat" style="max-width:100%;"></a>
    <a href="https://twitter.com/chainlit_io" rel="nofollow"><img alt="Twitter" src="https://img.shields.io/twitter/url/https/twitter.com/chainlit_io.svg?style=social&label=Follow%20%40chainlit_io" style="max-width:100%;"></a>
    <a href="https://pypistats.org/packages/chainlit" rel="nofollow"><img alt="Downloads" src="https://img.shields.io/pypi/dm/chainlit" style="max-width:100%;"></a>
        <a href="https://github.com/chainlit/chainlit/graphs/contributors" rel="nofollow"><img alt="Contributors" src="https://img.shields.io/github/contributors/chainlit/chainlit" style="max-width:100%;"></a>
    <a href="https://github.com/Chainlit/chainlit/actions/workflows/ci.yaml" rel="nofollow"><img alt="CI" src="https://github.com/Chainlit/chainlit/actions/workflows/ci.yaml/badge.svg" style="max-width:100%;"></a>
</p>

> ⚠️ **Notice:** Chainlit is now community-maintained.
>
> As of May 1st 2025, the original Chainlit team has stepped back from active development. The project is maintained by @Chainlit/chainlit-maintainers under a formal Maintainer Agreement.
>
> Maintainers are responsible for code review, releases, and security.  
> Chainlit SAS provides no warranties on future updates.
>
> Want to help maintain? [Apply here →](https://docs.google.com/forms/d/e/1FAIpQLSf6CllNWnKBnDIoj0m-DnHU6b0dj8HYFGixKy-_qNi_rD4iNA/viewform)

<p align="center">
    <a href="https://chainlit.io"><b>Website</b></a>  •  
    <a href="https://docs.chainlit.io"><b>Documentation</b></a>  •  
    <a href="https://help.chainlit.io"><b>Chainlit Help</b></a>  •  
    <a href="https://github.com/Chainlit/cookbook"><b>Cookbook</b></a>
</p>

<p align="center">
    <a href="https://trendshift.io/repositories/6708" target="_blank"><img src="https://trendshift.io/api/badge/repositories/6708" alt="Chainlit%2Fchainlit | Trendshift" style="width: 250px; height: 45px;" width="250" height="45"/></a>
</p>

https://github.com/user-attachments/assets/b3738aba-55c0-42fa-ac00-6efd1ee0d148

- **WebSocket Communication**: Real-time bidirectional communication between backend and frontend
- **Chat Management**: Message handling, conversation state management
- **AI Model Integration**: Support for various LLM providers and frameworks
- **File Handling**: Upload and processing of files and documents
- **Authentication**: User authentication and session management
- **Extensible Architecture**: Plugin system for custom integrations

## Installation

This package is typically installed as part of the Chainlit development environment:

```bash
pip install -e .
```

## Usage

The backend provides the core `chainlit` Python package that developers use to build conversational AI applications:

```python
import chainlit as cl

@cl.on_message
async def main(message: cl.Message):
    await cl.Message(content="Hello World!").send()
```

## Development

For development setup and contributing guidelines, please refer to the main Chainlit documentation.

## License

Apache-2.0 License 