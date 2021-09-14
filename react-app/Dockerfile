# pull base image
FROM node:14-alpine3.14 AS builder
# set working directory
WORKDIR /app
# copy dependency list
COPY ./package-lock.json .
COPY ./package.json .
RUN npm i
# add app source and resources
COPY . .
# create production build
RUN npm run build

# package production build into final container
FROM node:14-alpine3.14
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
RUN npm i -g serve
EXPOSE 5000
CMD ["serve", "-s", "build"]
