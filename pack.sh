pnpm clean && pnpm i --shamefully-hoist

# pnpm --filter @adguard/tswebextension... build
npx lerna run build --scope @adguard/tswebextension --include-dependencies

cd packages/css-tokenizer
pnpm pack

cd ../agtree
pnpm pack

cd ../tsurlfilter
pnpm pack

cd ../tswebextension
pnpm pack
