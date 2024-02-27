import { Socket } from "phoenix";

const user_id = document
  .querySelector("meta[name='user_id']")
  .getAttribute("content");
const room_code = document
  .querySelector("meta[name='room_code']")
  .getAttribute("content");

const socket = new Socket("/socket", { params: { token: window.userToken } });
socket.connect();

const channel = socket.channel("room:" + room_code, { user_id: user_id });

channel
  .join()
  .receive("ok", (resp) => {
    console.log("Joined successfully", resp);
  })
  .receive("error", (resp) => {
    console.log("Unable to join", resp);
  });

channel.onMessage = (event, payload, ref) => {
  console.log(event, payload, ref);

  return payload;
};

export default socket;
