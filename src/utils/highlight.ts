export interface Token {
  cls: string;
  text: string;
}

const DOCKER_INSTRUCTIONS = /^(FROM|RUN|CMD|LABEL|MAINTAINER|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\b/;

/** Tokenize a Dockerfile into lines of tokens */
export function tokenizeDockerfile(src: string): Token[][] {
  return src.split("\n").map((line) => {
    const tokens: Token[] = [];
    if (/^\s*#/.test(line)) return [{ cls: "tok-cmt", text: line }];
    let rest = line;
    const lead = rest.match(/^\s*/)?.[0] ?? "";
    if (lead) {
      tokens.push({ cls: "tok-plain", text: lead });
      rest = rest.slice(lead.length);
    }
    const instr = rest.match(DOCKER_INSTRUCTIONS);
    if (instr) {
      tokens.push({ cls: "tok-instr", text: instr[0] });
      rest = rest.slice(instr[0].length);
    }
    // generic scanner
    const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(--[a-zA-Z-]+(?:=[^\s]+)?)|(\$\{?[A-Za-z_][A-Za-z0-9_]*\}?)|(\bAS\b)|(\\\s*$)|(#.*$)|(&&|\|\||;)|([^\s"'$&|;\\#-]+|[-\s]+|.)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      if (m[1]) tokens.push({ cls: "tok-str", text: m[1] });
      else if (m[2]) tokens.push({ cls: "tok-flag", text: m[2] });
      else if (m[3]) tokens.push({ cls: "tok-var", text: m[3] });
      else if (m[4]) tokens.push({ cls: "tok-bool", text: m[4] });
      else if (m[5]) tokens.push({ cls: "tok-punct", text: m[5] });
      else if (m[6]) tokens.push({ cls: "tok-cmt", text: m[6] });
      else if (m[7]) tokens.push({ cls: "tok-punct", text: m[7] });
      else tokens.push({ cls: "tok-plain", text: m[0] });
    }
    return tokens;
  });
}

/** Tokenize YAML into lines of tokens */
export function tokenizeYaml(src: string): Token[][] {
  return src.split("\n").map((line) => {
    const tokens: Token[] = [];
    if (/^\s*#/.test(line)) return [{ cls: "tok-cmt", text: line }];
    if (/^---\s*$/.test(line)) return [{ cls: "tok-punct", text: line }];
    let rest = line;
    const lead = rest.match(/^\s*(-\s+)?/)?.[0] ?? "";
    if (lead) {
      tokens.push({ cls: lead.includes("-") ? "tok-punct" : "tok-plain", text: lead });
      rest = rest.slice(lead.length);
    }
    // key:
    const key = rest.match(/^("[^"]*"|'[^']*'|[^\s:#"'][^:#]*?)(:)(\s|$)/);
    if (key) {
      tokens.push({ cls: "tok-key", text: key[1] });
      tokens.push({ cls: "tok-punct", text: ":" });
      rest = rest.slice(key[1].length + 1);
    }
    const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#.*$)|(\b(?:true|false|yes|no|null|~)\b)|(\b-?\d+(?:\.\d+)?(?:[smhd])?\b)|([&*][A-Za-z0-9_-]+)|(\$\{?[A-Za-z_][A-Za-z0-9_]*\}?)|([\[\]{},|>])|([^\s"'#\[\]{},$&*]+|\s+|.)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      if (m[1]) tokens.push({ cls: "tok-str", text: m[1] });
      else if (m[2]) tokens.push({ cls: "tok-cmt", text: m[2] });
      else if (m[3]) tokens.push({ cls: "tok-bool", text: m[3] });
      else if (m[4]) tokens.push({ cls: "tok-num", text: m[4] });
      else if (m[5]) tokens.push({ cls: "tok-anchor", text: m[5] });
      else if (m[6]) tokens.push({ cls: "tok-var", text: m[6] });
      else if (m[7]) tokens.push({ cls: "tok-punct", text: m[7] });
      else tokens.push({ cls: key ? "tok-plain" : "tok-str", text: m[0] });
    }
    return tokens;
  });
}
