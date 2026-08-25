import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'dimension_input2_model.dart';
export 'dimension_input2_model.dart';

class DimensionInput2Widget extends StatefulWidget {
  const DimensionInput2Widget({
    super.key,
    this.label,
    this.hint,
  });

  final String? label;
  final double? hint;

  @override
  State<DimensionInput2Widget> createState() => _DimensionInput2WidgetState();
}

class _DimensionInput2WidgetState extends State<DimensionInput2Widget> {
  late DimensionInput2Model _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => DimensionInput2Model());

    _model.textController ??= TextEditingController();
    _model.textFieldFocusNode ??= FocusNode();

    WidgetsBinding.instance.addPostFrameCallback((_) => safeSetState(() {}));
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          valueOrDefault<String>(
            widget!.label,
            'Altura (cm)',
          ),
          style: FlutterFlowTheme.of(context).labelSmall.override(
                font: GoogleFonts.poppins(
                  fontWeight:
                      FlutterFlowTheme.of(context).labelSmall.fontWeight,
                  fontStyle: FlutterFlowTheme.of(context).labelSmall.fontStyle,
                ),
                color: FlutterFlowTheme.of(context).secondaryText,
                letterSpacing: 0.0,
                fontWeight: FlutterFlowTheme.of(context).labelSmall.fontWeight,
                fontStyle: FlutterFlowTheme.of(context).labelSmall.fontStyle,
              ),
        ),
        TextFormField(
          controller: _model.textController,
          focusNode: _model.textFieldFocusNode,
          obscureText: false,
          decoration: InputDecoration(
            hintText: valueOrDefault<String>(
              widget!.hint?.toString(),
              '0',
            ),
            enabledBorder: OutlineInputBorder(
              borderSide: BorderSide(
                color: Color(0x00000000),
                width: 1.0,
              ),
              borderRadius: BorderRadius.circular(18.0),
            ),
            focusedBorder: OutlineInputBorder(
              borderSide: BorderSide(
                color: Color(0x00000000),
                width: 1.0,
              ),
              borderRadius: BorderRadius.circular(18.0),
            ),
            errorBorder: OutlineInputBorder(
              borderSide: BorderSide(
                color: Color(0x00000000),
                width: 1.0,
              ),
              borderRadius: BorderRadius.circular(18.0),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderSide: BorderSide(
                color: Color(0x00000000),
                width: 1.0,
              ),
              borderRadius: BorderRadius.circular(18.0),
            ),
            filled: true,
            fillColor: FlutterFlowTheme.of(context).primaryBackground,
          ),
          style: TextStyle(
            color: FlutterFlowTheme.of(context).primaryText,
          ),
          maxLines: null,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          validator: _model.textControllerValidator.asValidator(context),
        ),
      ].divide(SizedBox(height: 4.0)),
    );
  }
}
