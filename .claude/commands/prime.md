## RUN

ls -la --color=auto # Basic listing

# ls -R | grep ":$" | sed -e 's/://' -e 's/[^-][^\/]\*\//--/g' -e 's/^/ /' -e 's/-/|/'

## READ

@README.md
@package.json
@src/index.ts
@src/server.ts
@src/tools/index.ts

## Remember

To run the MCP server: `npm run dev` or `yarn dev` to start the server in development mode
