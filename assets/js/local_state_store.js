// https://fly.io/phoenix-files/saving-and-restoring-liveview-state/

export const localStateStore = {
  mounted() {
    this.handleEvent("store", (event) => this.store(event));
    this.handleEvent("clear", (event) => this.clear(event));
    this.handleEvent("restore", (event) => this.restore(event));
  },

  store(event) {
    localStorage.setItem(event.key, event.data);
  },

  restore(event) {
    const data = localStorage.getItem(event.key);
    this.pushEvent(event.event, data);
  },

  clear(event) {
    localStorage.removeItem(event.key);
  },
};
