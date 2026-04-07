# Devcontainer Dockerfile for Elixir/Phoenix development
# Based on the project's production Dockerfile versions

ARG ELIXIR_VERSION=1.19.5
ARG OTP_VERSION=28.3.1
ARG DEBIAN_VERSION=bookworm-20260316-slim

FROM hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}

# Avoid warnings by switching to noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# Configure apt and install packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    git \
    inotify-tools \
    locales \
    openssh-client \
    sudo \
    gnupg \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set locale
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

# Install Node.js 22.x (for asset building)
ADD https://deb.nodesource.com/setup_22.x nodesource_setup.sh
RUN bash nodesource_setup.sh && apt-get install -y nodejs && rm nodesource_setup.sh

# Install pnpm for asset management
RUN npm install -g pnpm

# Install Biome for code formatting/linting
RUN npm install -g @biomejs/biome

# Install hex and rebar
RUN mix local.hex --force && mix local.rebar --force

# Set the working directory
WORKDIR /workspace

# Set the default user (for VS Code devcontainer)
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Create the user with proper home directory ownership
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME -s /bin/bash \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME \
    && mkdir -p /home/$USERNAME/.local/share/Cline \
    && mkdir -p /home/$USERNAME/.vscode-server/bin \
    && mkdir -p /home/$USERNAME/.ssh \
    && chmod 700 /home/$USERNAME/.ssh \
    && chown -R $USERNAME:$USERNAME /home/$USERNAME

# Set the default user
USER $USERNAME

# Set the default shell
ENV SHELL=/bin/bash