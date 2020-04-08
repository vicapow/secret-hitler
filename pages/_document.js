import React from 'react';
import Document, { Head, Main, NextScript } from 'next/document';
import { Html } from 'next/dist/pages/_document';

export default class CustomDocument extends Document {
  render() {
    return (
      <Html lang="en-US" className="h-full">
        <Head>
          <link href="https://unpkg.com/tailwindcss@^1.0/dist/tailwind.min.css" rel="stylesheet" />
          <link
            href="https://fonts.googleapis.com/css?family=Germania+One&display=swap"
            rel="stylesheet"
          />
        </Head>
        <body className="flex flex-col h-full">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
