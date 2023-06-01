FROM mcr.microsoft.com/devcontainers/base:bullseye as dev

RUN apt-get update -qq && \
  apt-get install -qq -y \
  curl \
  git \
  dirmngr \
  gpg \
  gawk \
  unzip \
  build-essential \
  autoconf \
  libssl-dev \
  libncurses5-dev \
  m4 \
  libssh-dev

RUN useradd -ms $(which bash) blunderfest

USER blunderfest

RUN git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.11.3 && \
  echo '. $HOME/.asdf/asdf.sh' >> $HOME/.bashrc && \
  echo '. $HOME/.asdf/asdf.sh' >> $HOME/.profile

ENV PATH /home/blunderfest/.asdf/bin:/home/blunderfest/.asdf/shims:$PATH

RUN /bin/bash -c "\
  asdf plugin-add elixir && \
  asdf plugin-add erlang && \
  asdf plugin-add nodejs \
  "

WORKDIR /app

COPY .tool-versions /app

RUN /bin/bash -c "ls -la && asdf install"
RUN /bin/bash -c "mix local.hex --force --if-missing"

ENV LANG C.UTF-8

WORKDIR /workspace
