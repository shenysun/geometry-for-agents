import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { createAppI18n } from "./i18n/index.ts";
import "./style.css";

const app = createApp(App);
app.use(createPinia());
app.use(createAppI18n());
app.mount("#app");
