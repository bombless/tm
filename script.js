function defineScope(variables) {
    const state = Vue.reactive(variables);
    const methods = {};
    return {
        defineMethod(name, method, expose = false) {
            methods[name] = {method, expose};
        },
        getVariables() {
            return state;
        },
        apply(method, args) {
            return methods[method].method.apply(state, args);
        },
        functions() {
            const ret = {};
            for (const k in methods) {
                const m = methods[k];
                const expose = m.expose;
                if (expose) ret[k] = () => m.method.call(state);
            }
            return ret;
        }
    };
}

const tape = defineScope({tape: [2, 5, 1], tape_position: 0});
tape.defineMethod('put', function(n) { this.tape[this.tape_position] = n; });
tape.defineMethod('read', function() { return this.tape[this.tape_position]; });
tape.defineMethod('left', function() { this.tape_position--; }, true);
tape.defineMethod('right', function() { this.tape_position++; }, true);

// 定义读写头（状态控制器）
const tapeHead = defineScope({
    state: 'q0',
    memory: null
});

// 暴露 next 按钮：严格按照状态转移表执行单步转移
tapeHead.defineMethod('next', function() {
    if (this.state === 'halt') return;

    const pos = tape.getVariables().tape_position;
    const val = tape.apply('read');

    switch (this.state) {
        case 'q0':
            if (pos === 0) {
                this.memory = val;
                tape.apply('right');
                this.state = 'q0';
            } else if (pos === 1) {
                if (val < this.memory) {
                    const tmp = val;
                    tape.apply('put', [this.memory]);
                    this.memory = tmp;
                    tape.apply('left');
                    this.state = 'q3';
                } else {
                    this.state = 'q1';
                }
            }
            break;

        case 'q1':
            if (pos === 0) {
                this.memory = val;
                tape.apply('right');
                this.state = 'q1';
            } else if (pos === 1) {
                tape.apply('right');
                this.state = 'q1';
            } else if (pos === 2) {
                if (val < this.memory) {
                    const tmp = val;
                    tape.apply('put', [this.memory]);
                    this.memory = tmp;
                    tape.apply('left');
                    this.state = 'q4';
                } else {
                    this.state = 'q2';
                }
            }
            break;

        case 'q2':
            if (pos === 1) {
                this.memory = val;
                tape.apply('right');
                this.state = 'q2';
            } else if (pos === 2) {
                if (val < this.memory) {
                    const tmp = val;
                    tape.apply('put', [this.memory]);
                    this.memory = tmp;
                    tape.apply('left');
                    this.state = 'q5';
                } else {
                    this.state = 'halt';
                }
            }
            break;

        case 'q3':
            if (pos > 0) {
                tape.apply('left');
                this.state = 'q3';
            } else {
                tape.apply('put', [this.memory]);
                tape.apply('right');
                this.state = 'q1';
            }
            break;

        case 'q4':
            if (pos > 0) {
                tape.apply('left');
                this.state = 'q4';
            } else {
                tape.apply('put', [this.memory]);
                tape.apply('right');
                this.state = 'q2';
            }
            break;

        case 'q5':
            if (pos > 1) {
                tape.apply('left');
                this.state = 'q5';
            } else {
                tape.apply('put', [this.memory]);
                tape.apply('right');
                this.state = 'halt';
            }
            break;
    }
}, true);

// 暴露 reset 按钮：重置纸带和状态机
tapeHead.defineMethod('reset', function() {
    const t = tape.getVariables();
    t.tape = [2, 5, 1];
    t.tape_position = 0;
    this.state = 'q0';
    this.memory = null;
}, true);

const app = Vue.createApp({
    data() {
        return {
            tapeVariables: tape.getVariables(),
            tapeFunctions: tape.functions(),
            headVariables: tapeHead.getVariables(),
            headFunctions: tapeHead.functions(),
        }
    }
});
app.config.compilerOptions.isCustomElement = (tag) => ['actions', 'tape', 'tape-head'].includes(tag);
app.mount('main');
