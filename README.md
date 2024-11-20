# DSG [BETA RELEASE]

DSG is a VSCode extension that helps programmers generate useful and consistent docstrings for functions and classes in any codebase. By leveraging large language models from OpenAI or those supported by Ollama, the extension automates and standardizes the process of writing docstrings. This tool aims to improve documentation quality, reduce manual effort, and improve code maintainability. 

## Features

Generate docstrings: Automatically generate docstrings for Python, JavaScript, Java, and C++.

Customizable models: Choose between OpenAI and Llama-based models for docstring generation.

Style options: Select from various docstring styles such as Google, Javadoc, and more.

<!-- Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file. -->

<!-- For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow. -->

## Requirements

<!-- If you have any requirements or dependencies, add a section describing those and how to install and configure them. -->
- VSCode Version: 1.93.0+ 
- LLM model: A compatible LLM model (e.g., OpenAI or Ollama) is required for the extension to function.

## Extension Settings

<!-- Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.  -->
The extension provides the following settings:

- LLM Model: Select your preferred LLM model (e.g., OpenAI or Ollama).
- Docstring Style: Choose from predefined styles like Google, NumPy, or Javadoc.

## Known Issues

No major issues reported yet.

## Release Notes

### 1.0.0

Initial release of DSG extension with basic UI functionality.

### 1.0.1

Fixed UI bug.

### 1.1.0

Added regenerate docstring and programming language support for Python, JavaScript, Java, and C++.

<!-- ---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!** -->