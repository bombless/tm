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
    },
    computed: {
        transitionRows() {
            const {enum_status, status_offset, position, replace_task, last_number} = this.tapeHeadVariables;
            const currentSymbol = this.tapeVariables.tape[this.tapeVariables.tape_position];
            const rows = [];

            enum_status.forEach((status, index) => {
                const [left, right] = status.split(':').map(Number);
                const state = `q${index}`;
                const isCurrentState = index === status_offset;
                const isReplacing = isCurrentState && replace_task !== null;
                const comparisonSucceeded = currentSymbol < last_number;

                rows.push({
                    state,
                    condition: `位置 = ${left}`,
                    write: '不变',
                    move: 'R',
                    next: `记录符号，${state}`,
                    active: isCurrentState && replace_task === null && position === left,
                });
                rows.push({
                    state,
                    condition: `位置 = ${right} 且 读入 < 已记录值`,
                    write: '已记录值',
                    move: 'L',
                    next: `回填到位置 ${left}`,
                    active: isCurrentState && replace_task === null && position === right && comparisonSucceeded,
                });
                rows.push({
                    state,
                    condition: `位置 = ${right} 且 读入 ≥ 已记录值`,
                    write: '不变',
                    move: 'S',
                    next: index + 1 < enum_status.length ? `q${index + 1}` : '结束',
                    active: isCurrentState && replace_task === null && position === right && !comparisonSucceeded,
                });
                rows.push({
                    state: `回填 q${index}`,
                    condition: `目标位置 ${left} < 当前位置`,
                    write: '不变',
                    move: 'L',
                    next: `回填 q${index}`,
                    active: isReplacing && Number(replace_task) === left && left < position,
                });
                rows.push({
                    state: `回填 q${index}`,
                    condition: `当前位置 ≤ 目标位置 ${left}`,
                    write: '已记录值',
                    move: 'R',
                    next: index + 1 < enum_status.length ? `q${index + 1}` : '结束',
                    active: isReplacing && Number(replace_task) === left && left >= position,
                });
                rows.push({
                    state,
                    condition: `位置 ≠ ${left} 且 位置 ≠ ${right}`,
                    write: '不变',
                    move: 'R',
                    next: state,
                    active: isCurrentState && replace_task === null && position !== left && position !== right,
                });
            });

            return rows;
        }
    },
    methods: {
        runTapeHeadAction(action) {
            action();
            this.$nextTick(() => {
                const activeRow = document.querySelector('.transition-table tr.is-active');
                if (activeRow) {
                    activeRow.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'smooth'});
                }
            });
        }
    }
});
app.config.compilerOptions.isCustomElement = (tag) => ['actions', 'tape', 'tape-head'].includes(tag)
app.mount('main');
