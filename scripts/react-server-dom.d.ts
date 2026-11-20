// The end-to-end script drives Server Actions with React's own reply encoder,
// which Next ships compiled without type declarations.
declare module "next/dist/compiled/react-server-dom-turbopack-experimental/cjs/react-server-dom-turbopack-client.node.development.js" {
  export function encodeReply(value: unknown): Promise<FormData | string>;
}
