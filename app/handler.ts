
import { Handler, Context } from 'aws-lambda';
import dotenv from 'dotenv';
import path from 'path';
const dotenvPath = path.join(__dirname, process.env.ENV_RELATIVE_PATH, `config/.env.${process.env.NODE_ENV}`);
dotenv.config({
  path: dotenvPath,
});

import { books } from './model';
import { BooksController } from './contrller/books';
const booksController = new BooksController(books);

export const create: Handler = (event: any, context: Context) => {
  return booksController.create(event, context);
};

export const update: Handler = (event: any) => booksController.update(event);

export const find: Handler = () => booksController.find();

export const findOne: Handler = (event: any, context: Context) => {
  return booksController.findOne(event, context);
};

export const deleteOne: Handler = (event: any) => booksController.deleteOne(event);