# # Base Node image
# FROM node:18

# # Install OpenJDK
# RUN apt-get update && apt-get install -y openjdk-17-jdk

# # Set JAVA_HOME (optional)
# ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
# ENV PATH=$JAVA_HOME/bin:$PATH

# # App directory
# WORKDIR /usr/src/app

# # Copy app
# COPY package*.json ./
# RUN npm install
# COPY . .

# EXPOSE 3000
# CMD ["npm", "start"]
# Base Node image
FROM node:18

# Install OpenJDK, Python and prerequisites
RUN apt-get update && apt-get install -y \
    wget \
    apt-transport-https \
    software-properties-common \
    openjdk-17-jdk \
    python3 \
    python3-pip \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Set JAVA_HOME (optional)
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

# Install .NET 6.0 SDK
RUN wget https://packages.microsoft.com/config/debian/11/packages-microsoft-prod.deb -O packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y dotnet-sdk-6.0 \
    && rm -rf /var/lib/apt/lists/*

# App directory
WORKDIR /usr/src/app

# Copy app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
