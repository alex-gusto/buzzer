import type { FastifyPluginCallback } from 'fastify';

declare module '@fastify/static' {
  interface FastifyStaticOptions {
    root: string | string[];
    prefix?: string;
    index?: string[];
  }

  const fastifyStatic: FastifyPluginCallback<FastifyStaticOptions>;
  export default fastifyStatic;
}

declare module 'fastify' {
  interface FastifyReply {
    sendFile(filename: string): this;
  }
}
