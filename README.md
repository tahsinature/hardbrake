# HardBrake

HardBrake is a wrapper around [HandBrake CLI](https://github.com/HandBrake/HandBrake) for encoding multiple files with ease. HardBrake lets you encode multiple files at once and shows the progress for each file. With HardBrake, you don't have to encode each file individually, saving you time and effort. While it is not concurrent at this moment, HardBrake is still a useful tool for encoding your files. Give HardBrake a try and see how it can make your file encoding workflow more efficient.

## Demo 🎬

<details>
<summary>With Handbrake</summary>
<img style="width: 100%" src="demo/handbrake-gui.gif" />
</details>
<details>

<summary>With HardBrake</summary>
<img style="width: 100%" src="demo/hardbrake.gif" />
</details>

## Installation

Install via bun:

```sh
bun install --global hardbrake
```

Or, directly run via bun:

```sh
bunx hardbrake
```

To specify a version:

```sh
bunx hardbrake@latest (or any version)
```

## Usage

```sh
hardbrake
```

## License

HardBrake is licensed under the MIT License. See the LICENSE file for more information.
