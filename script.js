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
tape.defineMethod('left', function() { this.tape_position--; });
tape.defineMethod('right', function() { this.tape_position++; });


const policy = defineScope({
    enum_status: ['0:1', '0:2', '1:2'],
    replace_task: null,
    status_offset: 0,
    last_number: null,
    position: 0,
    error_message: null
});

const cursor = new Proxy({}, {
    get: (_, name) => (...args) => tape.apply(name, args)
});

function next() {
    if (this.position < 0 || this.position > 2) {
        this.error_message = '位置超出允许范围（0 到 2），已停止执行。';
        return;
    }
    if (this.status_offset < 0 || this.status_offset >= this.enum_status.length) {
        this.error_message = '状态偏移量超出允许范围，已停止执行。';
        return;
    }
    this.error_message = null;

    if (this.replace_task === null) {
        const [x, y] = this.enum_status[this.status_offset].split(':');
        if (x == this.position) {
            this.last_number = cursor.read();
            cursor.right();
            this.position += 1;
        }
        else if (y == this.position) {
            const number = cursor.read();
            if (number < this.last_number) {
                this.replace_task = x;
                cursor.put(this.last_number);
                this.last_number = number;
                cursor.left();
                this.position -= 1;
            } else {
                this.status_offset += 1;
            }
        }
        else {
            cursor.right();
            this.position += 1;
        }
    } else {
        if (this.replace_task < this.position) {
            cursor.left();
            this.position -= 1;
        } else {
            cursor.put(this.last_number);
            this.status_offset += 1;
            cursor.right();
            this.position += 1;
            this.replace_task = null;
        }
    }
}

policy.defineMethod('next', next, true);

const app = Vue.createApp({
    data() {
        return {
            tapeVariables: tape.getVariables(),
            tapeHeadVariables: policy.getVariables(),
            tapeFunctions: tape.functions(),
            tapeHeadFunctions: policy.functions(),
        }
    }
});
app.config.compilerOptions.isCustomElement = (tag) => ['actions', 'tape', 'tape-head'].includes(tag)
app.mount('main');
