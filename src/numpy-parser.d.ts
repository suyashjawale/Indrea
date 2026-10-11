declare module 'numpy-parser' {
    // export function parse(buffer: ArrayBuffer): Record<string, any>;

	export function fromArrayBuffer(npzArrayBuffer: ArrayBufferLike):any;
}