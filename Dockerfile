FROM node:current-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm ci
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY tsconfig.json .
COPY webpack.config.js .
COPY src src
COPY static static
COPY post post

RUN npm run build

EXPOSE 8000

ENTRYPOINT [ "npm", "start" ]
