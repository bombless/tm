function defineScope(variables) {
    const methods = {};
    return {
        defineMethod(name, method, expose = false) {
            methods[name] = {method, expose};
        },
        getVariables() {
            return Object.assign({}, variables);
        },
        apply(method, args) {
            return methods[method].method.apply(variables, args);
        },
        functions() {
            const ret = {};
            for (const k in methods) {
                const m = methods[k];
                const expose = m.expose;
                if (expose) ret[k] = m.method;

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
    position: 0
});


function next(cursor) {
    if (replace_task === null) {
        const [x, y] = enum_status[status_offset].split(':');
        if (x === position) {
            last_number = cursor.read();
            cursor.right();
            position += 1;
        }
        else if (y === position) {
            const number = cursor.read();
            if (number < last_number) {
                replace_task = x;
                cursor.put(last_number);
                last_number = number;
                position -= 1;
            } else {
                statsus_offset += 1;
            }
        }
        else {
            cursor.right();
            position += 1;
        }
    } else {
        if (replace_task < position) {
            cursor.left();
            position -= 1;
        } else {
            cursor.put(last_number);
            status_offset += 1;
        }
    }
}

policy.defineMethod('next', next, true);

const app = Vue.createApp({
    data() {
        return {
            'tape-variables': tape.getVariables(),
            'tape-head-variables': policy.getVariables()
        }
    }
});
app.config.compilerOptions.isCustomElement = (tag) => ['tape', 'tape-head'].includes(tag)
app.mount('main');
