import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import AWS from "aws-sdk";
import { v4 } from "uuid";
import * as yup from "yup";

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = "BooksTable";
const headers = {
  "content-type": "application/json",
};

const schema = yup.object().shape({
  author: yup.string().required(),
  title: yup.string().required(),
  description: yup.string().required(),
  publication_date: yup.date()
  .required(),
  available: yup.bool().required(),
});

export const createBook = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event.body as string);

    await schema.validate(reqBody, { abortEarly: false });

    const book = {
      ...reqBody,
      ISBN: v4(),
    };

    await docClient
      .put({
        TableName: tableName,
        Item: book,
      })
      .promise();

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(book),
    };
  } catch (e) {
    return handleError(e);
  }
};

class HttpError extends Error {
  constructor(public statusCode: number, body: Record<string, unknown> = {}) {
    super(JSON.stringify(body));
  }
}

const fetchBookById = async (id: string) => {
  const output = await docClient
    .get({
      TableName: tableName,
      Key: {
        ISBN: id,
      },
    })
    .promise();

  if (!output.Item) {
    throw new HttpError(404, { error: "not found" });
  }

  return output.Item;
};

const handleError = (e: unknown) => {
  if (e instanceof yup.ValidationError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        errors: e.errors,
      }),
    };
  }

  if (e instanceof SyntaxError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `invalid request body format : "${e.message}"` }),
    };
  }

  if (e instanceof HttpError) {
    return {
      statusCode: e.statusCode,
      headers,
      body: e.message,
    };
  }

  throw e;
};

export const getBook = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const book = await fetchBookById(event.pathParameters?.id as string);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(book),
    };
  } catch (e) {
    return handleError(e);
  }
};

export const updateBook = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id as string;

    await fetchBookById(id);

    const reqBody = JSON.parse(event.body as string);

    await schema.validate(reqBody, { abortEarly: false });

    const book = {
      ...reqBody,
      ISBN: id,
    };

    await docClient
      .put({
        TableName: tableName,
        Item: book,
      })
      .promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(book),
    };
  } catch (e) {
    return handleError(e);
  }
};

export const deleteBook = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id as string;

    await fetchBookById(id);

    await docClient
      .delete({
        TableName: tableName,
        Key: {
          ISBN: id,
        },
      })
      .promise();

    return {
      statusCode: 204,
      body: "Record deleted successfully ",
    };
  } catch (e) {
    return handleError(e);
  }
};

export const listBook = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const output = await docClient
    .scan({
      TableName: tableName,
    })
    .promise();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(output.Items),
  };
};
