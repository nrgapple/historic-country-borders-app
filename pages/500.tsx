export default function Custom500() {
  return (
    <div className="error-container">
      <h1>An Error Occurred... Ops...</h1>
      <p>Please check the discord for status updates!</p>
      <iframe
        src="https://ptb.discord.com/widget?id=1118256717382299708&theme=dark"
        width="350"
        height="500"
        //@ts-ignore
        allowtransparency="true"
        frameborder="0"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
      ></iframe>
    </div>
  );
}
