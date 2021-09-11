# pull base image
FROM node:alpine
# set working directory
WORKDIR /app
# copy dependency list
COPY ./package-lock.json .
COPY ./package.json .
RUN npm i
# add app source and resources
COPY . .
# expose port
EXPOSE 3000
# start process
CMD ["npm", "start"]
